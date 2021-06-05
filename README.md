# Nextcloud Artifact Upload Action
Upload artifacts to nextcloud and outputs a shareable URL.

### How it looks:
![image](https://user-images.githubusercontent.com/23460729/120891750-7f247380-c60a-11eb-9998-3b3b7f61066f.png)

### Example:
Simple example. Globbing is supported. 

```yaml
on:
  pull_request:
  push:
jobs:
  build-test:
    name: Build & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2                               # checkout the repo

      - name: Nextcloud Artifact
        uses: trympet/nextcloud-artifacts-action@v2
        with:
          name: 'my-artifact'                                   # Name of the artifact
          path: 'bin/**/*.exe'                                  # Globbing supported
          nextcloud-url: 'https://nextcloud.example.com'        # Format of test results
          nextcloud-username: ${{ secrets.NEXTCLOUD_USERNAME }} # Username from repository secret
          nextcloud-password: ${{ secrets.NEXTCLOUD_PASSWORD }} # Password from repository secret
```
