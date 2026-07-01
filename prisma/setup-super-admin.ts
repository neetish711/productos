/**
 * Setup script: Creates the designated Super Admin user.
 * Run: npx tsx prisma/setup-super-admin.ts
 * Also runs automatically during build on Railway.
 *
 * AUDIT P0-6: credentials are read from environment variables, never hardcoded.
 * Configure these in your deploy environment:
 *   SUPER_ADMIN_EMAIL     (required — if unset, this script is a no-op)
 *   SUPER_ADMIN_PASSWORD  (optional — a strong random password is generated and
 *                          printed once on first creation if omitted)
 *   SUPER_ADMIN_NAME      (optional)
 *   SUPER_ADMIN_ORG       (optional, defaults to "RedProduct")
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME || 'Super Admin'
const ORG_NAME = process.env.SUPER_ADMIN_ORG || 'RedProduct'

const ALL_PERMISSIONS = [
  'view_roadmap','create_roadmap','edit_roadmap','delete_roadmap',
  'view_competitors','create_competitors','edit_competitors','delete_competitors',
  'view_prds','create_prds','edit_prds','delete_prds',
  'submit_for_review','approve_story','reject_story',
  'view_features','create_features','edit_features','delete_features',
  'create_ideas',
  'manage_users','manage_products','manage_permissions','manage_pending_requests','assign_senior_pm',
]

function orgSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-')
}

async function main() {
  // AUDIT P0-6: do nothing (rather than seed a well-known account) when unconfigured.
  if (!SUPER_ADMIN_EMAIL) {
    console.warn('SUPER_ADMIN_EMAIL not set — skipping super admin setup. Set it to provision the initial admin.')
    return
  }

  const prisma = new PrismaClient()

  try {
    const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
    if (existing) {
      // Ensure they are SUPER_ADMIN, but never reset an existing password.
      if (existing.role !== 'SUPER_ADMIN' || existing.status !== 'APPROVED') {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'SUPER_ADMIN',
            status: 'APPROVED',
            permissionsJson: JSON.stringify(ALL_PERMISSIONS),
          },
        })
        console.log(`Upgraded ${SUPER_ADMIN_EMAIL} to SUPER_ADMIN`)
      } else {
        console.log(`Super Admin ${SUPER_ADMIN_EMAIL} already exists`)
      }
      return
    }

    // AUDIT DB#6: look up org by unique slug (name is not unique).
    const slug = orgSlug(ORG_NAME)
    let org = await prisma.organization.findUnique({ where: { slug } })
    if (!org) {
      org = await prisma.organization.create({ data: { name: ORG_NAME, slug } })
      console.log(`Created organization: ${ORG_NAME}`)
    }

    // AUDIT P0-6: use the configured password, or generate a strong random one
    // and print it exactly once so the operator can capture and rotate it.
    let password = process.env.SUPER_ADMIN_PASSWORD
    if (!password) {
      password = randomBytes(18).toString('base64url')
      console.log('──────────────────────────────────────────────────────────────')
      console.log(`Generated Super Admin password for ${SUPER_ADMIN_EMAIL}:`)
      console.log(`  ${password}`)
      console.log('Store it now and change it after first login — it is not shown again.')
      console.log('──────────────────────────────────────────────────────────────')
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: {
        name: SUPER_ADMIN_NAME,
        email: SUPER_ADMIN_EMAIL,
        passwordHash,
        role: 'SUPER_ADMIN',
        status: 'APPROVED',
        organizationId: org.id,
        permissionsJson: JSON.stringify(ALL_PERMISSIONS),
      },
    })
    console.log(`Created Super Admin: ${SUPER_ADMIN_EMAIL}`)

    // Ensure a default product + access exist (idempotent).
    let product = await prisma.product.findFirst({ where: { organizationId: org.id } })
    if (!product) {
      product = await prisma.product.create({
        data: {
          name: 'Default Product',
          description: 'Your first product workspace',
          organizationId: org.id,
          createdById: user.id,
        },
      })
      console.log('Created default product')
    }

    await prisma.userProductAccess.create({
      data: { userId: user.id, productId: product.id },
    }).catch(() => {}) // Skip if exists

    console.log('Super Admin setup complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
