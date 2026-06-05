-- CreateIndex
CREATE INDEX "Like_userId_createdAt_postId_idx" ON "Like"("userId", "createdAt", "postId");
