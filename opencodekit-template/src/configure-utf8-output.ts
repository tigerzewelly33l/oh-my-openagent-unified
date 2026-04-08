export function configureUtf8Output(): void {
  if (process.stdout.setEncoding) {
    process.stdout.setEncoding("utf8");
  }

  if (process.stderr.setEncoding) {
    process.stderr.setEncoding("utf8");
  }
}
