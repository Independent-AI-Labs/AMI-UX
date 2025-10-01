import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const CERT_DIR = path.resolve(process.cwd(), '.next', 'certs')
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem')
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem')

function generateCertificate() {
  if (!fs.existsSync(CERT_DIR)) {
    fs.mkdirSync(CERT_DIR, { recursive: true })
  }

  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    console.log('✓ Using existing certificates')
    return { key: KEY_FILE, cert: CERT_FILE }
  }

  console.log('⚙ Generating self-signed certificate...')

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 365 ` +
        `-keyout "${KEY_FILE}" -out "${CERT_FILE}" ` +
        `-subj "/C=US/ST=State/L=City/O=AMI/CN=localhost" ` +
        `-addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.50.66"`,
      { stdio: 'inherit' }
    )
    console.log('✓ Certificate generated')
  } catch (err) {
    console.error('✖ Failed to generate certificate:', err.message)
    process.exit(1)
  }

  return { key: KEY_FILE, cert: CERT_FILE }
}

export { generateCertificate, KEY_FILE, CERT_FILE }

if (import.meta.url === `file://${process.argv[1]}`) {
  generateCertificate()
}
