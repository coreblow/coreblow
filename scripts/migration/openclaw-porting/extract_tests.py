import sys
for f in sys.argv[1:]:
    print(f"\n--- {f.split('/')[-1]} ---")
    with open(f, 'r') as file:
        for i, line in enumerate(file):
            if i < 25:
                print(line.rstrip())
            elif i == 25:
                print("... [truncated]")
