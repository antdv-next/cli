import { join } from 'node:path'
import { __dirname } from '@/constants/dirname.ts'

export function getDataPath(): string {
    return join(__dirname, '..', 'data')
}
