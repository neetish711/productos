/**
 * Setup script: Creates the designated Super Admin user.
 * Run: npx tsx prisma/setup-super-admin.ts
 * Also runs automatically during build on Railway.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const SUPER_ADMIN_EMAIL = 'Nitish@redproduct.com'
const SUPER_ADMIN_PASSWORD = 'Qwerty@54321'
const SUPER_ADMIN_NAME = 'Nitish (Super Admin)'
const ORG_NAME = 'RedProduct'

const ALL_PERMISSIONS = [
  'view_roadmap','create_roadmap','edit_roadmap','delete_roadmap',
  'view_competitors','create_competitors','edit_competitors','delete_competitors',
  'view_prds','create_prds','edit_prds','delete_prds',
  'submit_for_review','approve_story','reject_story',
  'view_features','create_features','edit_features','delete_features',
  'create_ideas',
  'manage_users','manage_products','manage_permissions','manage_pending_requests','assign_senior_pm',
]

async function main() {
  const prisma = new PrismaClient()

  try {
    // Check if super admin already exists
    const existing = await prisma.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } })
    if (existing) {
      // Ensure they are SUPER_ADMIN
      if (existing.role !== 'SUPER_ADMIN') {
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

    // Find or create org
    let org = await prisma.organization.findFirst({ where: { name: ORG_NAME } })
    if (!org) {
      org = await prisma.organization.create({
        data: {
          name: ORG_NAME,
          slug: ORG_NAME.toLowerCase().replace(/\s+/g, '-'),
        },
      })
      console.log(`Created organization: ${ORG_NAME}`)
    }

    // Create super admin user
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12)
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

    // Create default product if none exists
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

    // Grant product access
    await prisma.userProductAccess.create({
      data: { userId: user.id, productId: product.id },
    }).catch(() => {}) // Skip if exists

    console.log('Super Admin setup complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
