import { Box, Image, SimpleGrid, Text } from '@mantine/core';

type PostContentProps = {
  postText?: string;
  postImages?: string[];
};

export function PostContent({ postText, postImages }: PostContentProps) {
  return (
    <Box mt={4}>
      {postText && (
        <Text size="sm" mb={postImages && postImages.length > 0 ? 'xs' : 0}>
          {postText}
        </Text>
      )}

      {postImages && postImages.length > 0 && (
        <SimpleGrid cols={postImages.length === 1 ? 1 : 2} spacing="xs">
          {postImages.map((url) => (
            <Image
              key={url}
              src={url}
              radius="lg"
              h={postImages.length === 1 ? 'auto' : 160}
              fit="cover"
              fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
            />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
