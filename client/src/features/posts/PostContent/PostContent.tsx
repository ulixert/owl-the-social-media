import { useState } from 'react';
import { Box, Grid, Image, SimpleGrid, Stack, Text, Modal, ActionIcon } from '@mantine/core';
import { IconX } from '@tabler/icons-react';

type PostContentProps = {
  postText?: string;
  postImages?: string[];
};

export function PostContent({ postText, postImages }: PostContentProps) {
  const [opened, setOpened] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const imageCount = postImages?.length ?? 0;

  const handleImageClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    setSelectedImage(url);
    setOpened(true);
  };

  const renderImages = () => {
    if (!postImages || imageCount === 0) return null;

    if (imageCount === 1) {
      return (
        <Image
          src={postImages[0]}
          radius="lg"
          h="auto"
          mah={500}
          fit="contain"
          style={{ backgroundColor: 'var(--mantine-color-gray-1)', cursor: 'pointer' }}
          fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
          onClick={(e) => handleImageClick(e, postImages[0])}
        />
      );
    }

    if (imageCount === 2) {
      return (
        <SimpleGrid cols={2} spacing="xs">
          {postImages.map((url) => (
            <Image
              key={url}
              src={url}
              radius="lg"
              h={280}
              fit="cover"
              fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleImageClick(e, url)}
            />
          ))}
        </SimpleGrid>
      );
    }

    if (imageCount === 3) {
      return (
        <Grid gutter="xs">
          <Grid.Col span={6}>
            <Image
              src={postImages[0]}
              radius="lg"
              h={320}
              fit="cover"
              fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleImageClick(e, postImages[0])}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <Stack gap="xs">
              <Image
                src={postImages[1]}
                radius="lg"
                h={155}
                fit="cover"
                fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleImageClick(e, postImages[1])}
              />
              <Image
                src={postImages[2]}
                radius="lg"
                h={155}
                fit="cover"
                fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleImageClick(e, postImages[2])}
              />
            </Stack>
          </Grid.Col>
        </Grid>
      );
    }

    // 4 or more images
    return (
      <SimpleGrid cols={2} spacing="xs">
        {postImages.slice(0, 4).map((url) => (
          <Image
            key={url}
            src={url}
            radius="lg"
            h={160}
            fit="cover"
            fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
            style={{ cursor: 'pointer' }}
            onClick={(e) => handleImageClick(e, url)}
          />
        ))}
      </SimpleGrid>
    );
  };

  return (
    <Box mt={4}>
      {postText && (
        <Text size="sm" mb={imageCount > 0 ? 'xs' : 0}>
          {postText}
        </Text>
      )}
      {renderImages()}

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        fullScreen
        padding={0}
        withCloseButton={false}
        styles={{
          content: {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          },
          body: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          },
        }}
      >
        <ActionIcon
          pos="absolute"
          top={20}
          left={20}
          variant="subtle"
          color="white"
          size="xl"
          radius="xl"
          onClick={() => setOpened(false)}
          style={{ zIndex: 1000 }}
        >
          <IconX size={32} />
        </ActionIcon>

        {selectedImage && (
          <Image
            src={selectedImage}
            fit="contain"
            w="100%"
            h="100%"
            fallbackSrc="https://placehold.co/800x600?text=Invalid+URL"
          />
        )}
      </Modal>
    </Box>
  );
}
