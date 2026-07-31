import type { ImageProps } from 'expo-image';
import { Image as NImage } from 'expo-image';
import { styled } from 'nativewind';
import * as React from 'react';

export type ImgProps = ImageProps & {
  className?: string;
};

const StyledNImage = styled(NImage, { className: 'style' });

export const Image = ({ style, className, placeholder = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4', ...props }: ImgProps) => {
  return <StyledNImage className={className} placeholder={placeholder} style={style} {...props} />;
};

export const preloadImages = (sources: string[]) => {
  NImage.prefetch(sources);
};
