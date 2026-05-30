"""Audio transcription using faster-whisper.

One-shot mode: python transcribe.py <audio_file> [model_size]
Daemon mode:   python transcribe.py --daemon [model_size]
               Reads JSON lines from stdin: {"audio_path":"..."}
               Writes JSON lines to stdout: {"transcript":"..."} or {"error":"..."}
"""
import sys
import os
import json

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

from faster_whisper import WhisperModel


def load_model(model_size="small"):
    print(f"[ASR] Loading model '{model_size}'...", file=sys.stderr, flush=True)
    return WhisperModel(model_size, device="cpu", compute_type="int8")


def transcribe_file(model, audio_path):
    segments, info = model.transcribe(audio_path, beam_size=5, language="zh", vad_filter=True)
    print(f"[ASR] Detected: {info.language} (p={info.language_probability:.2f})", file=sys.stderr, flush=True)
    lines = []
    for seg in segments:
        lines.append(seg.text.strip())
        print(f"  [{seg.start:.1f}s -> {seg.end:.1f}s] {seg.text.strip()}", file=sys.stderr, flush=True)
    return "\n".join(lines)


def run_oneshot(audio_path, model_size="small"):
    model = load_model(model_size)
    text = transcribe_file(model, audio_path)
    print("=== TRANSCRIPT ===")
    print(text)


def run_daemon(model_size="small"):
    model = load_model(model_size)
    print(json.dumps({"status": "ready"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            audio_path = req["audio_path"]
            if not os.path.exists(audio_path):
                print(json.dumps({"error": f"File not found: {audio_path}"}), flush=True)
                continue
            text = transcribe_file(model, audio_path)
            print(json.dumps({"transcript": text}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "--daemon":
        model_size = sys.argv[2] if len(sys.argv) > 2 else "small"
        run_daemon(model_size)
    else:
        if len(sys.argv) < 2:
            print("Usage: python transcribe.py <audio_file> [model_size]", file=sys.stderr)
            print("       python transcribe.py --daemon [model_size]", file=sys.stderr)
            sys.exit(1)
        audio_file = sys.argv[1]
        model_size = sys.argv[2] if len(sys.argv) > 2 else "small"
        if not os.path.exists(audio_file):
            print(f"Error: audio file not found: {audio_file}", file=sys.stderr)
            sys.exit(1)
        run_oneshot(audio_file, model_size)
