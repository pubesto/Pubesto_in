-- AlterTable
ALTER TABLE "tax_settings" ADD COLUMN     "businessAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "legalName" TEXT NOT NULL DEFAULT 'Pubesto';
