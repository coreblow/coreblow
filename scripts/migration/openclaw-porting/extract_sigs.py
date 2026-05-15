import sys, re
for f in sys.argv[1:]:
    print(f"\n--- {f.split('/')[-1]} ---")
    with open(f, 'r') as file:
        for line in file:
            line = line.strip()
            if line.startswith('public ') or line.startswith('struct ') or line.startswith('enum ') or line.startswith('class '):
                print(line)
