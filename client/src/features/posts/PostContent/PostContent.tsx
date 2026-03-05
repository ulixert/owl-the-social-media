import { useState } from 'react';
import { Box, Grid, Image, SimpleGrid, Stack, Text, Modal, ActionIcon, Group } from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

type PostContentProps = {
  postText?: string;
  postImages?: string[];
};

export function PostContent({ postText, postImages }: PostContentProps) {
  const [opened, setOpened] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const imageCount = postImages?.length ?? 0;

  const handleImageClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedIndex(index);
    setOpened(true);
  };

  const handlePrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : imageCount - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev < imageCount - 1 ? prev + 1 : 0));
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
          onClick={(e) => handleImageClick(e, 0)}
        />
      );
    }

    if (imageCount === 2) {
      return (
        <SimpleGrid cols={2} spacing="xs">
          {postImages.map((url, index) => (
            <Image
              key={url}
              src={url}
              radius="lg"
              h={280}
              fit="cover"
              fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleImageClick(e, index)}
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
              onClick={(e) => handleImageClick(e, 0)}
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
                onClick={(e) => handleImageClick(e, 1)}
              />
              <Image
                src={postImages[2]}
                radius="lg"
                h={155}
                fit="cover"
                fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                style={{ cursor: 'pointer' }}
                onClick={(e) => handleImageClick(e, 2)}
              />
            </Stack>
          </Grid.Col>
        </Grid>
      );
    }

    // 4 or more images
    return (
      <SimpleGrid cols={2} spacing="xs">
        {postImages.slice(0, 4).map((url, index) => (
          <Image
            key={url}
            src={url}
            radius="lg"
            h={160}
            fit="cover"
            fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
            style={{ cursor: 'pointer' }}
            onClick={(e) => handleImageClick(e, index)}
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
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') handlePrevious();
          if (e.key === 'ArrowRight') handleNext();
        }}
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
          onClick={(e) => {
            e.stopPropagation();
            setOpened(false);
          }}
          style={{ zIndex: 1000 }}
        >
          <IconX size={32} />
        </ActionIcon>

        {imageCount > 1 && (
          <>
            <ActionIcon
              pos="absolute"
              left={20}
              variant="subtle"
              color="white"
              size="xl"
              radius="xl"
              onClick={handlePrevious}
              style={{ zIndex: 1000 }}
            >
              <IconChevronLeft size={48} />
            </ActionIcon>

            <ActionIcon
              pos="absolute"
              right={20}
              variant="subtle"
              color="white"
              size="xl"
              radius="xl"
              onClick={handleNext}
              style={{ zIndex: 1000 }}
            >
              <IconChevronRight size={48} />
            </ActionIcon>

            <Group pos="absolute" bottom={20} gap="xs" style={{ zIndex: 1000 }}>
              {postImages?.map((_, idx) => (
                <Box
                  key={idx}
                  w={8}
                  h={8}
                  style={{
                    borderRadius: '50%',
                    backgroundColor: idx === selectedIndex ? 'white' : 'rgba(255, 255, 255, 0.5)',
                    transition: 'background-color 200ms ease',
                  }}
                />
              ))}
            </Group>
          </>
        )}

        {postImages && (
          <Image
            src={postImages[selectedIndex]}
            fit="contain"
            w="100%"
            h="100%"
            fallbackSrc="https://placehold.co/800x600?text=Invalid+URL"
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </Modal>
    </Box>
  );
}

