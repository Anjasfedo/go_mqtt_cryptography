package main

import (
	"encoding/json"
	"fmt"
	"math/rand"

	"github.com/klauspost/compress/zstd"
)

type SensorData struct {
	SensorID  string  `json:"sensor_id"`
	Temp      float64 `json:"temp"`
	HeartRate int     `json:"heart_rate"`
	Oxygen    int     `json:"oxygen"`
}

func main() {
	reads := []int{20, 50, 100}

	for _, count := range reads {
		var readings []SensorData
		for i := 0; i < count; i++ {
			readings = append(readings, SensorData{
				SensorID:  fmt.Sprintf("S%d", i+1),
				Temp:      36.0 + rand.Float64(),
				HeartRate: 60 + rand.Intn(40),
				Oxygen:    95 + rand.Intn(5),
			})
		}

		originalData, _ := json.Marshal(readings)

		encoder, _ := zstd.NewWriter(nil)
		compressedData := encoder.EncodeAll(originalData, make([]byte, 0, len(originalData)))
		encoder.Close()

		origSize := float64(len(originalData))
		compSize := float64(len(compressedData))
		dcr := ((origSize - compSize) / origSize) * 100

		fmt.Printf("Number of reads: %d\n", count)
		fmt.Printf("Original Size: %d bytes\n", int(origSize))
		fmt.Printf("Compressed Size: %d bytes\n", int(compSize))
		fmt.Printf("Data Compression Ratio: %.2f%%\n\n", dcr)
	}
}
