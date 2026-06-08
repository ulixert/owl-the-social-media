import { useState } from 'react';

import { ActionIcon, Box, Group, Image, Modal, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';

import { isVideoUrl } from '@/utils/media.ts';
import { PostVideo } from '../PostVideo/PostVideo.tsx';
import classes from './PostContent.module.css';

type PostContentProps = {
  postText?: string;
  postImages?: string[];
};

// Height of each slide in the swipeable carousel (multi-media posts).
const SLIDE_HEIGHT = 430;
// Max height for a single, full-width media item before it's capped.
const SINGLE_MAX_HEIGHT = 520;

export function PostContent({ postText, postImages }: PostContentProps) {
  const [opened, setOpened] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const mediaCount = postImages?.length ?? 0;

  const openLightbox = (index: number) => {
    setSelectedIndex(index);
    setOpened(true);
  };

  const handleMediaClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    openLightbox(index);
  };

  const handlePrevious = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : mediaCount - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIndex((prev) => (prev < mediaCount - 1 ? prev + 1 : 0));
  };

  const renderMedia = () => {
    if (!postImages || mediaCount === 0) return null;

    // A single item gets a full-width treatment (image contained to a max
    // height; video plays inline). Clicking it opens the full-window viewer.
    if (mediaCount === 1) {
      if (isVideoUrl(postImages[0])) {
        return (
          <PostVideo
            src={postImages[0]}
            maxHeight={500}
            onExpand={() => openLightbox(0)}
          />
        );
      }

      return (
        // No fixed width or backdrop: the image sizes to its own aspect ratio
        // (capped by height and the card width), so portrait media never gets
        // letterbox bars around it.
        <Image
          src={postImages[0]}
          radius="lg"
          h="auto"
          w="auto"
          mah={SINGLE_MAX_HEIGHT}
          maw="100%"
          style={{ cursor: 'pointer' }}
          fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
          onClick={(e) => handleMediaClick(e, 0)}
        />
      );
    }

    // Two or more: a horizontally swipeable row. Each slide keeps its own
    // aspect ratio at a shared height; images and videos can mix freely.
    return (
      <div className={classes.carousel}>
        {postImages.map((url, index) =>
          isVideoUrl(url) ? (
            <div key={url} className={classes.slide}>
              <PostVideo
                src={url}
                height={SLIDE_HEIGHT}
                onExpand={() => openLightbox(index)}
              />
            </div>
          ) : (
            <div key={url} className={classes.slide}>
              <Image
                src={url}
                h={SLIDE_HEIGHT}
                w="auto"
                maw="100%"
                fit="cover"
                fallbackSrc="https://placehold.co/400x300?text=Invalid+URL"
                // min-width: 0 lets a too-wide image be capped to the slide so
                // object-fit: cover can center-crop it (flex items don't shrink
                // below content width otherwise).
                style={{ cursor: 'pointer', display: 'block', minWidth: 0 }}
                onClick={(e) => handleMediaClick(e, index)}
              />
            </div>
          ),
        )}
      </div>
    );
  };

  const current = postImages?.[selectedIndex];
  const currentIsVideo = current ? isVideoUrl(current) : false;

  return (
    <Box mt={4}>
      {postText && (
        <Text size="sm" mb={mediaCount > 0 ? 'xs' : 0}>
          {postText}
        </Text>
      )}
      {renderMedia()}

      {/* Full-window viewer: steps through every item (image or video).
          The Modal renders in a portal, but React bubbles its events through
          the component tree, so any click inside would also reach the enclosing
          PostItem's onClick and navigate to the post. This wrapper stops that at
          the boundary — whatever is clicked inside the viewer, it never reaches
          the feed item. (display: contents so the wrapper adds no box.) */}
      <Box
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'contents' }}
      >
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
          onClick={() => setOpened(false)}
        styles={{
          content: {
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
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

        {mediaCount > 1 && (
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
                    backgroundColor:
                      idx === selectedIndex
                        ? 'white'
                        : 'rgba(255, 255, 255, 0.5)',
                    transition: 'background-color 200ms ease',
                  }}
                />
              ))}
            </Group>
          </>
        )}

        {current &&
          (currentIsVideo ? (
            <video
              key={current}
              src={current}
              controls
              autoPlay
              loop
              playsInline
              // Sized to its own bounds (not full-bleed) so the surrounding
              // area is true backdrop; stop propagation so clicking the video
              // or its controls doesn't close the viewer.
              onClick={(e) => e.stopPropagation()}
              style={{ maxHeight: '100%', maxWidth: '100%', outline: 'none' }}
            />
          ) : (
            // Fills the window (preserving aspect ratio), so the image element
            // covers the whole viewport — clicking anywhere (image or the
            // letterbox) closes. stopPropagation keeps the click from bubbling
            // (through the portal) to the enclosing PostItem and navigating.
            <Image
              src={current}
              fit="contain"
              h="100%"
              w="100%"
              fallbackSrc="https://placehold.co/800x600?text=Invalid+URL"
              style={{ cursor: 'zoom-out' }}
              onClick={(e) => {
                e.stopPropagation();
                setOpened(false);
              }}
            />
          ))}
        </Modal>
      </Box>
    </Box>
  );
}
