-- CreateTable
CREATE TABLE "GenerationVideo" (
    "generationId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationVideo_pkey" PRIMARY KEY ("generationId")
);
