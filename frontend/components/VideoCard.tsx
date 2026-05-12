import {
    RefObject
  } from 'react';
  
  type Props = {
    title: string;
    videoRef: RefObject<HTMLVideoElement | null>;
    muted?: boolean;
  };
  
  export default function VideoCard({
    title,
    videoRef,
    muted
  }: Props) {
  
    return (
  
      <div className="
        bg-zinc-900
        rounded-3xl
        overflow-hidden
        border
        border-zinc-800
        shadow-2xl
      ">
  
        <div className="
          px-4
          py-3
          border-b
          border-zinc-800
          text-zinc-400
          text-sm
        ">
          {title}
        </div>
  
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          playsInline
          className="
            w-full
            aspect-video
            object-cover
            bg-black
          "
        />
  
      </div>
  
    );
  
  }