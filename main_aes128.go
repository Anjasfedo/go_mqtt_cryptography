package main

import (
	"bytes"
	"crypto/aes"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"math"
	"os"
	"os/signal"
	"syscall"

	mqtt "github.com/mochi-mqtt/server/v2"
	"github.com/mochi-mqtt/server/v2/hooks/auth"
	"github.com/mochi-mqtt/server/v2/listeners"
	"github.com/mochi-mqtt/server/v2/packets"
)

type DecryptHook struct {
	mqtt.HookBase
}

func (h *DecryptHook) ID() string {
	return "decrypt-hook"
}

func (h *DecryptHook) Provides(b byte) bool {
	return bytes.Contains([]byte{mqtt.OnPublish}, []byte{b})
}

func (h *DecryptHook) OnPublish(cl *mqtt.Client, pk packets.Packet) (packets.Packet, error) {
	if pk.TopicName == "sensors/data" {
		processPayload(pk.Payload)
	}
	return pk, nil
}

func main() {
	server := mqtt.New(nil)
	_ = server.AddHook(new(auth.AllowHook), nil)
	_ = server.AddHook(new(DecryptHook), nil)

	tcp := listeners.NewTCP(listeners.Config{
		ID:      "t1",
		Address: ":1883",
	})

	err := server.AddListener(tcp)
	if err != nil {
		log.Fatal(err)
	}

	go func() {
		err := server.Serve()
		if err != nil {
			log.Fatal(err)
		}
	}()

	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
}

func processPayload(hexPayload []byte) {
	keyHex := "000102030405060708090A0B0C0D0E0F"
	key, _ := hex.DecodeString(keyHex)
	cipherText, _ := hex.DecodeString(string(hexPayload))

	block, _ := aes.NewCipher(key)
	decrypted := make([]byte, len(cipherText))

	for i := 0; i < len(cipherText); i += block.BlockSize() {
		block.Decrypt(decrypted[i:i+block.BlockSize()], cipherText[i:i+block.BlockSize()])
	}

	paddingLen := int(decrypted[len(decrypted)-1])
	if paddingLen > 0 && paddingLen <= len(decrypted) {
		unpadded := decrypted[:len(decrypted)-paddingLen]

		if len(unpadded) >= 8 {
			tempBits := binary.LittleEndian.Uint32(unpadded[0:4])
			temp := math.Float32frombits(tempBits)

			humBits := binary.LittleEndian.Uint32(unpadded[4:8])
			hum := math.Float32frombits(humBits)

			fmt.Printf("Temp: %.2f, Hum: %.2f\n", temp, hum)
		}
	}
}
