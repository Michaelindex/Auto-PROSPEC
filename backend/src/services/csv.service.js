import { parse } from 'csv-parse/sync'
import { normalizePhone, classifyPhone, formatE164 } from '../utils/phone.js'
import { extractFirstName } from '../utils/name.js'
import prisma from '../prisma/client.js'

export async function processCSV(buffer) {
  const text = buffer.toString('utf-8')

  let records
  try {
    records = parse(text, { delimiter: [',', ';'], trim: true, skip_empty_lines: true })
  } catch {
    records = parse(text, { delimiter: ';', trim: true, skip_empty_lines: true })
  }

  if (records.length === 0) return { total: 0, mobile: 0, landline: 0, invalid: 0, duplicates: 0, savedContactIds: [] }

  // Detect header
  let startIdx = 0
  const firstRow = records[0].map(c => c.toLowerCase())
  const hasHeader = firstRow.some(c => ['nome', 'name', 'numero', 'number', 'telefone', 'phone'].includes(c))
  if (hasHeader) startIdx = 1

  const seenPhones = new Set()
  const stats = { total: 0, mobile: 0, landline: 0, invalid: 0, duplicates: 0 }
  const toUpsert = []

  for (let i = startIdx; i < records.length; i++) {
    const row = records[i]
    const rawName = row[0] || ''
    const rawPhone = row[1] || ''

    stats.total++

    const normalized = normalizePhone(rawPhone)
    const { valid, type } = classifyPhone(normalized)

    if (!valid) { stats.invalid++; continue }
    if (type === 'landline') { stats.landline++; continue }

    const e164 = formatE164(normalized)

    if (seenPhones.has(e164)) { stats.duplicates++; continue }
    seenPhones.add(e164)

    stats.mobile++
    toUpsert.push({
      phone: e164,
      firstName: extractFirstName(rawName),
      rawName: rawName.trim(),
      type: 'mobile'
    })
  }

  const savedContactIds = []
  for (const contact of toUpsert) {
    const saved = await prisma.contact.upsert({
      where: { phone: contact.phone },
      create: contact,
      update: { firstName: contact.firstName, rawName: contact.rawName }
    })
    savedContactIds.push(saved.id)
  }

  return { ...stats, savedContactIds }
}
