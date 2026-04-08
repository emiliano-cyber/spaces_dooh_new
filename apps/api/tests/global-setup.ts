import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default function setup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') })
}
