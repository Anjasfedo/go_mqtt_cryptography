import zstandard as zstd
import zlib
import bz2
import lzma
import brotli
import lz4.frame
import urllib.request
import time
import sys

# 1. Download alice29.txt
url = "https://raw.githubusercontent.com/google/snappy/master/testdata/alice29.txt"
print(f"Downloading {url}...")
try:
    with urllib.request.urlopen(url) as response:
        raw_data = response.read()
except:
    print("Download failed, using dummy text data.")
    raw_data = b"Alice was beginning to get very tired of sitting by her sister on the bank" * 1000

orig_size = len(raw_data)

# --- Manual Implementations for older/simple schemes ---

def rle_compress(data):
    if not data: return b""
    res = []
    i = 0
    while i < len(data):
        count = 1
        while i + 1 < len(data) and data[i] == data[i+1] and count < 255:
            count += 1
            i += 1
        res.append(count)
        res.append(data[i])
        i += 1
    return bytes(res)

def lzw_compress(data):
    dict_size = 256
    dictionary = {bytes([i]): i for i in range(dict_size)}
    w = b""
    result = []
    for byte in data:
        byte = bytes([byte])
        wc = w + byte
        if wc in dictionary:
            w = wc
        else:
            result.append(dictionary[w])
            dictionary[wc] = dict_size
            dict_size += 1
            w = byte
    if w:
        result.append(dictionary[w])
    return b"".join([i.to_bytes((i.bit_length() // 8) + 1, byteorder='big') for i in result])

# --- Test Runner ---

def run_test(name, category, compress_func):
    start = time.time()
    try:
        compressed = compress_func(raw_data)
        end = time.time()
        comp_size = len(compressed)
        dcr = ((orig_size - comp_size) / orig_size) * 100
        duration = (end - start) * 1000
        print(f"{name:.<18} | {category:<12} | {comp_size:>8} B | {dcr:>7.2f}% | {duration:>8.2f} ms")
    except Exception as e:
        print(f"{name:.<18} | Error: {str(e)}")

print(f"\nOriginal Size: {orig_size} bytes\n")
print(f"{'Algorithm':<18} | {'Category':<12} | {'Size':<10} | {'DCR':<8} | {'Latency'}")
print("-" * 75)

# Dictionary + Entropy (Modern)
run_test("Zstandard (ANS)", "Mixed", lambda d: zstd.ZstdCompressor(level=3).compress(d))
run_test("Brotli (Huffman)", "Mixed", lambda d: brotli.compress(d))

# LZ77 / Deflate Family
run_test("zlib/Deflate", "LZ77+Huff", lambda d: zlib.compress(d))
run_test("LZ4", "LZ77", lambda d: lz4.frame.compress(d))

# Dictionary (Heavy/Markov)
run_test("LZMA (7zip)", "LZ+Markov", lambda d: lzma.compress(d))

# Transform Based
run_test("Bzip2 (BWT)", "BWT", lambda d: bz2.compress(d))

# Older/Simple
run_test("LZW (GIF/Unix)", "Dictionary", lambda d: lzw_compress(d))
run_test("RLE", "Simple", lambda d: rle_compress(d))