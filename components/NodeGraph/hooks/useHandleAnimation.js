import { useState, useEffect } from 'react';

export function useHandleAnimation(isHovered) {
    const [handleProgress, setHandleProgress] = useState(0);

    useEffect(() => {
        let animationFrame;
        let start;
        const duration = 200; // ms
        const animate = (timestamp) => {
            if (!start) start = timestamp;
            const elapsed = timestamp - start;
            let progress;
            if (isHovered) {
                progress = Math.min(elapsed / duration, 1);
            } else {
                progress = Math.max(1 - elapsed / duration, 0);
            }
            setHandleProgress(progress);
            if ((isHovered && progress < 1) || (!isHovered && progress > 0)) {
                animationFrame = requestAnimationFrame(animate);
            }
        };
        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [isHovered]);

    return handleProgress;
}