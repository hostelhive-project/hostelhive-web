import { useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import Modal from '../components/Modal';

export function useUnsavedChanges(dirty: boolean) {
  const [allowed, setAllowed] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const blocker = useBlocker(dirty && !allowed);
  useBeforeUnload(useCallback((event) => {
    if (dirty && !allowed) { event.preventDefault(); event.returnValue = ''; }
  }, [dirty, allowed]));
  useEffect(() => {
    if (!allowed || !pending.current) return;
    const action = pending.current; pending.current = null; action();
  }, [allowed]);
  const allowNavigation = (action: () => void) => { pending.current = action; setAllowed(true); };
  const leaveDialog = <Modal isOpen={blocker.state === 'blocked'} onClose={() => { if (blocker.state === 'blocked') blocker.reset(); }} title="Discard unsaved changes?" description="Your changes have not been saved. Keep editing or discard them before leaving.">
    <div className="flex flex-wrap justify-end gap-3">
      <button type="button" className="auth-secondary-button" onClick={() => { if (blocker.state === 'blocked') blocker.reset(); }}>Keep editing</button>
      <button type="button" className="auth-secondary-button" onClick={() => { if (blocker.state === 'blocked') blocker.proceed(); }}>Discard & leave</button>
    </div>
  </Modal>;
  return { leaveDialog, allowNavigation };
}
