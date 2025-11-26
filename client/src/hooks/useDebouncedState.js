import { useEffect, useState } from 'react';

function useDebouncedState(initialValue, delay) {
    const [value, setValue] = useState(initialValue);
    const [debouncedValue, setDebouncedValue] = useState(initialValue);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [value, delay]);

    return [value, setValue, debouncedValue];
}

export default useDebouncedState;
