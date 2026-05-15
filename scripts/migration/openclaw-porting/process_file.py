import sys
import os

def process_file(oc_path, cb_path):
    print(f"Processing {os.path.basename(oc_path)}...")
    if not os.path.exists(oc_path):
        print(f"Error: OC file not found: {oc_path}")
        return

    with open(oc_path, 'r') as f:
        content = f.read()

    if os.path.exists(cb_path):
        with open(cb_path, 'r') as f:
            cb_content = f.read()
        print(f"Read existing CB file ({len(cb_content.splitlines())} lines).")
    else:
        print("CB file does not exist. Will create it.")
        # Ensure dir exists
        os.makedirs(os.path.dirname(cb_path), exist_ok=True)

    # Perform replacements
    content = content.replace("OpenClaw", "CoreBlow")
    content = content.replace("openclaw", "coreblow")

    with open(cb_path, 'w') as f:
        f.write(content)

    print(f"Wrote to CB file ({len(content.splitlines())} lines).")

if __name__ == "__main__":
    if len(sys.argv) == 3:
        process_file(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python3 process_file.py <oc_path> <cb_path>")
