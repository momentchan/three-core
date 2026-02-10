import { useState, useEffect, ComponentProps } from 'react';
import { Leva } from 'leva';
import { customTheme } from './theme';

interface LevaWrapperProps extends Omit<ComponentProps<typeof Leva>, 'hidden'> {
    initialHidden?: boolean;
}

export function LevaWrapper({ initialHidden = false, ...props }: LevaWrapperProps) {

    const [hidden, setHidden] = useState(initialHidden);

    useEffect(() => {
        const handleKeyPress = (event: KeyboardEvent) => {
            if (event.code === 'KeyH') {
                setHidden(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    return (
        <Leva theme={customTheme as any} hidden={hidden} {...props} />
    )
}
