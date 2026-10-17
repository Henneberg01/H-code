# Publish H-Code to its independent GitHub repository

GitHub account verified in this project session: `henneberg1`. The connected GitHub integration cannot create repositories. The Henneberg Browser MCP bridge was disconnected, and the `h-code` repository did not exist when last checked. No remote push has been performed.

## Easiest path

1. Open https://github.com/new
2. Choose owner `henneberg1`, repository name `h-code`, visibility **Private** during development.
3. For an API-assisted import, initialize with a README so `main` exists. Then ask ChatGPT to push the H-Code M1 source to `henneberg1/h-code`. GitHub integration can add files to existing repositories.
4. Alternatively create an **empty repository** and run the commands below using the included local Git history.

## Local Git route after creating an empty remote

```bash
# From a clone of the included .bundle history
# git clone H-Code-M1-symbol-libraries.bundle h-code
cd h-code
git remote remove origin
git remote add origin https://github.com/henneberg1/h-code.git
git push -u origin main
```

Never push this work to an unrelated FastSell repository.
