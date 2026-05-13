import sys
import re

def analyze_swift_file(filepath):
    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()
        print(f"File: {filepath}")
        print(f"Total Lines: {len(lines)}")

        # Extract structs, classes, actors, protocols, enums
        declarations = []
        for i, line in enumerate(lines):
            line = line.strip()
            if line.startswith('public ') or line.startswith('internal ') or line.startswith('class ') or line.startswith('struct ') or line.startswith('enum ') or line.startswith('actor ') or line.startswith('protocol '):
                if '{' in line and not line.endswith('}'):
                    declarations.append(f"Line {i+1}: {line}")

        print("Declarations:")
        for d in declarations[:20]:
            print(f"  {d}")
        if len(declarations) > 20:
            print(f"  ... and {len(declarations) - 20} more.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_swift_file(sys.argv[1])
