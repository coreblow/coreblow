import sys

def process(src, dst):
    with open(src, "r") as f:
        content = f.read()

    # Replacements
    content = content.replace("OpenClaw", "CoreBlow")
    content = content.replace("openclaw", "coreblow")
    content = content.replace("openClaw", "coreBlow")

    # Prefix OC -> CB, like OCLogger -> CBLogger
    import re
    content = re.sub(r'\bOC([A-Z])', r'CB\1', content)

    with open(dst, "w") as f:
        f.write(content)

process(sys.argv[1], sys.argv[2])
