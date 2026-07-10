import { useState, ComponentProps } from 'react';
import { Leva } from 'leva';
import { customTheme } from './theme';
import { useShortcut } from '@core/hooks/useShortcut';

type LevaDock = 'top-left' | 'top-right';

interface LevaWrapperProps extends Omit<ComponentProps<typeof Leva>, 'hidden'> {
    initialHidden?: boolean;
    /** Which corner the panel docks to. Defaults to top-left. */
    dock?: LevaDock;
}

export function LevaWrapper({ initialHidden = false, dock = 'top-left', ...props }: LevaWrapperProps) {

    const [hidden, setHidden] = useState(initialHidden);

    useShortcut('h', () => {
        setHidden(prev => !prev);
    });

    // Leva anchors its fixed panel top-right (right: 10px) with no built-in
    // reposition prop, so override the anchor on the panel root (our direct
    // child div) when docking left.
    const dockCss =
        dock === 'top-left'
            ? '.leva-dock > div { left: 10px !important; right: auto !important; }'
            : '';

    return (
        <div className="leva-dock">
            {dockCss && <style>{dockCss}</style>}
            <Leva theme={customTheme as any} hidden={hidden} {...props} />
        </div>
    )
}
