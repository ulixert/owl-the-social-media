-- Emit the full previous row image on UPDATE/DELETE for "Like" so that CDC
-- delete events carry "postId" (the default REPLICA IDENTITY is the primary key
-- only). The like-counter consumer needs postId to decrement the right post.
ALTER TABLE "Like" REPLICA IDENTITY FULL;
