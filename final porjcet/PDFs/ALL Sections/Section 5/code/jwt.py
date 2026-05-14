import base64


payload = "eyJzdWIiOiJhZG1pbiIsImV4cCI6MTc3MzgzMzkzNn0"
decoded = base64.urlsafe_b64decode(payload + "==")
print(decoded)