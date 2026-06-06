import { useNavigate } from 'react-router-dom';

import {
  Flex,
  Image,
  UnstyledButton,
  rem,
  useComputedColorScheme,
} from '@mantine/core';

type LogoProps = {
  size?: number;
  justify?: React.CSSProperties['justifyContent'];
};

export function Logo({ size = 30, justify = 'center' }: LogoProps) {
  const computedColorScheme = useComputedColorScheme('light');
  const navigate = useNavigate();

  return (
    <Flex justify={justify}>
      <UnstyledButton w={rem(size)} onClick={() => navigate('/')}>
        <Image
          src={
            computedColorScheme === 'light'
              ? '/logo/owl-dark.svg'
              : '/logo/owl-light.svg'
          }
          alt="logo"
        />
      </UnstyledButton>
    </Flex>
  );
}
