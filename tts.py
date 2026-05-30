"""TTS using edge-tts with SSML support for natural speech.
Usage: python tts.py <text_or_ssml> <voice> <output_path> [rate] [pitch]
Plain text is auto-wrapped in SSML. Pass raw SSML by starting text with '<speak'."""
import asyncio
import sys
import re

import edge_tts


def build_ssml(text, voice, rate="+0%", pitch="+0Hz"):
    """Wrap plain text in SSML with natural pauses and conversational style."""
    if text.strip().startswith("<speak"):
        return text  # already SSML

    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    # Insert natural pauses at punctuation for human-like rhythm
    processed = escaped
    processed = re.sub(r"([。！？])\s*", r"\1<break time='350ms'/>", processed)
    processed = re.sub(r"([，；：、])\s*", r"\1<break time='150ms'/>", processed)
    # Pause at paragraph breaks (double newlines or newline after sentence-end)
    processed = re.sub(r"<break time='350ms'/>\s*\n", "<break time='350ms'/>\n<break time='400ms'/>", processed)

    return (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"'
        ' xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">'
        f'<voice name="{voice}">'
        f'<prosody rate="{rate}" pitch="{pitch}">'
        f'<mstts:express-as style="chat" styledegree="1.1">'
        f'{processed}'
        '</mstts:express-as>'
        '</prosody>'
        '</voice>'
        '</speak>'
    )


async def main():
    if len(sys.argv) < 4:
        print("Usage: python tts.py <text> <voice> <output_path> [rate] [pitch]", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1]
    voice = sys.argv[2]
    output_path = sys.argv[3]
    rate = sys.argv[4] if len(sys.argv) > 4 else "+0%"
    pitch = sys.argv[5] if len(sys.argv) > 5 else "+0Hz"

    ssml = build_ssml(text, voice, rate, pitch)
    communicate = edge_tts.Communicate(ssml, voice, rate=rate, pitch=pitch)
    await communicate.save(output_path)


if __name__ == "__main__":
    asyncio.run(main())
