-- CreateTable
CREATE TABLE "service_request_files" (
    "id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(127) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_request_files_object_key_key" ON "service_request_files"("object_key");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_files_service_request_id_position_key" ON "service_request_files"("service_request_id", "position");

-- AddForeignKey
ALTER TABLE "service_request_files" ADD CONSTRAINT "service_request_files_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
