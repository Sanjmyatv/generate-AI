-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "invoice" JSONB,
ADD COLUMN     "lastCheckAt" TIMESTAMP(3),
ADD COLUMN     "qpayPaymentId" TEXT;
