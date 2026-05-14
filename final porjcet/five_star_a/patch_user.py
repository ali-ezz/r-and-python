with open("backend/app/services/user_service.py", "r") as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.strip() == "for key, value in data.items():":
        new_lines.extend([
            "\tfor key, value in data.items():\n",
            "\t\tif key in ['email', 'username']:\n",
            "\t\t\texisting = db.query(User).filter(getattr(User, key) == value, User.id != user.id).first()\n",
            "\t\t\tif existing:\n",
            "\t\t\t\traise HTTPException(status_code=400, detail=f\"{key.capitalize()} already registered\")\n"
        ])
    else:
        new_lines.append(line)

with open("backend/app/services/user_service.py", "w") as f:
    f.writelines(new_lines)

print("Patched!")
