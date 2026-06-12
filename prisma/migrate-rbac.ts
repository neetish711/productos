/**
 * Migration script: Sets up RBAC defaults for existing data.
 * - Grants all existing users APPROVED status
 * - Sets default permissions based on role
 * - Creates UserProductAccess entries for all existing users → all products
 * - Ensures at least one ADMIN/SUPER_ADMIN user exists
 *
 * Run: npx tsx prisma/migrate-rbac.ts
 */
import { PrismaClient } from '@prisma/client'

const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: [
    'view_roadmap','create_roadmap','edit_roadmap','delete_roadmap',
    'view_competitors','create_competitors','edit_competitors','delete_competitors',
    'view_prds','create_prds','edit_prds','delete_prds',
    'submit_for_review','approve_story','reject_story',
    'view_features','create_features','edit_features','delete_features',
    'manage_users','manage_products','manage_permissions',
  ],
  ADMIN: [
    'view_roadmap','create_roadmap','edit_roadmap','delete_roadmap',
    'view_competitors','create_competitors','edit_competitors','delete_competitors',
    'view_prds','create_prds','edit_prds','delete_prds',
    'submit_for_review','approve_story','reject_story',
    'view_features','create_features','edit_features','delete_features',
    'manage_users','manage_products','manage_permissions',
  ],
  PM: [
    'view_roadmap','create_roadmap','edit_roadmap','delete_roadmap',
    'view_competitors','create_competitors','edit_competitors','delete_competitors',
    'view_prds','create_prds','edit_prds','delete_prds',
    'view_features','create_features','edit_features','delete_features',
    'submit_for_review','approve_story','reject_story',
  ],
  EDITOR: [
    'view_roadmap','create_roadmap','edit_roadmap',
    'view_competitors','create_competitors','edit_competitors',
    'view_prds','create_prds','edit_prds',
    'view_features','create_features','edit_features',
    'submit_for_review',
  ],
  VIEWER: [
    'view_roadmap','view_competitors','view_prds','view_features',
  ],
}

async function main() {
  const prisma = new PrismaClient()

  try {
    console.log('Starting RBAC migration...\n')

    // 1. Update all existing users to APPROVED and set permissions
    const users = await prisma.user.findMany()
    console.log(`Found ${users.length} users`)

    for (const user of users) {
      const role = user.role || 'PM'
      const permissions = ROLE_DEFAULTS[role] || ROLE_DEFAULTS.VIEWER

      // Upgrade old ADMIN users to SUPER_ADMIN if they were the first user
      let newRole = role
      if (role === 'ADMIN') {
        newRole = 'SUPER_ADMIN'
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'APPROVED',
          role: newRole,
          permissionsJson: JSON.stringify(ROLE_DEFAULTS[newRole] || permissions),
        },
      })
      console.log(`  Updated user: ${user.email} → role=${newRole}, status=APPROVED`)
    }

    // 2. Grant all users access to all products in their org
    const orgs = await prisma.organization.findMany({
      include: {
        users: { select: { id: true } },
        products: { select: { id: true } },
      },
    })

    let accessCount = 0
    for (const org of orgs) {
      for (const user of org.users) {
        for (const product of org.products) {
          try {
            await prisma.userProductAccess.create({
              data: { userId: user.id, productId: product.id },
            })
            accessCount++
          } catch {
            // Skip duplicates
          }
        }
      }
    }
    console.log(`\nCreated ${accessCount} UserProductAccess entries`)

    // 3. Summary
    const productCount = await prisma.product.count()
    const userCount = await prisma.user.count()
    console.log(`\nMigration complete!`)
    console.log(`  ${userCount} users updated with permissions`)
    console.log(`  ${productCount} products linked to users`)
    console.log(`  All existing users are APPROVED and have access to all products`)

  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
