-- CreateIndex
CREATE INDEX "Like_userId_id_idx" ON "Like"("userId", "id");

-- CreateIndex
CREATE INDEX "Post_postedById_id_idx" ON "Post"("postedById", "id");

-- CreateIndex
CREATE INDEX "Post_parentPostId_id_idx" ON "Post"("parentPostId", "id");

-- CreateIndex
CREATE INDEX "Save_userId_id_idx" ON "Save"("userId", "id");
