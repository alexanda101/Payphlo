-- Add nullable display name so existing users keep working.
ALTER TABLE "User" ADD COLUMN "name" TEXT;
