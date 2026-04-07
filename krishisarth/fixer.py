import os

file_path = 'e:\\KrishiSarth\\krishisarth\\frontend\\src\\pages\\farm-3d.js'
with open(file_path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('\\`', '`').replace('\\${', '${')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(c)

print("done")
