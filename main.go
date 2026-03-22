package main

import (
	"bytes"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/klauspost/compress/zstd"
	mqtt "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"
	"github.com/mochi-mqtt/server/v2/packets"
)

type ZstdDynamicHook struct {
	mqtt.HookBase
	decoders map[byte]*zstd.Decoder
}

func (h *ZstdDynamicHook) ID() string {
	return "zstd-dynamic-hook"
}

func (h *ZstdDynamicHook) Provides(b byte) bool {
	return bytes.Contains([]byte{mqtt.OnPublish}, []byte{b})
}

func (h *ZstdDynamicHook) OnPublish(cl *mqtt.Client, pk packets.Packet) (packets.Packet, error) {
	if pk.TopicName == "sensors/dictionary" && len(pk.Payload) > 1 {
		version := pk.Payload[0]
		dictBytes := pk.Payload[1:]

		decoder, err := zstd.NewReader(nil, zstd.WithDecoderDicts(dictBytes))
		if err != nil {
			fmt.Printf("[Server] Error creating decoder v%d: %v\n", version, err)
			return pk, nil
		}
		h.decoders[version] = decoder
		fmt.Printf("[Server] Successfully loaded Dictionary v%d (%d bytes).\n", version, len(dictBytes))

	} else if pk.TopicName == "sensors/data" && len(pk.Payload) > 1 {
		version := pk.Payload[0]
		compressedData := pk.Payload[1:]

		decoder, exists := h.decoders[version]
		if !exists {
			fmt.Printf("[Server] Unknown dictionary version: %d\n", version)
			return pk, nil
		}

		startTime := time.Now()
		decompressedData, err := decoder.DecodeAll(compressedData, nil)
		if err != nil {
			fmt.Printf("[Server] Decompression error: %v\n", err)
			return pk, nil
		}

		processingDelay := time.Since(startTime)
		fmt.Printf("[Server] Decompressed with dict v%d. Compressed: %d B, Decompressed: %d B, Delay: %v\n", version, len(compressedData), len(decompressedData), processingDelay)
	}
	return pk, nil
}

func main() {
	server := mqtt.New(nil)
	_ = server.AddHook(new(auth.AllowHook), nil)

	hook := &ZstdDynamicHook{
		decoders: make(map[byte]*zstd.Decoder),
	}
	_ = server.AddHook(hook, nil)

	tcp := listeners.NewTCP(listeners.Config{
		ID:      "t1",
		Address: ":1883",
	})
	_ = server.AddListener(tcp)

	go func() {
		_ = server.Serve()
	}()

	fmt.Println("Mochi MQTT Server listening on :1883. Ready for dynamic dictionaries.")
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
}
