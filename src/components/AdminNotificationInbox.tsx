import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useListAdminNotificationsQuery, useAdminUnreadCountQuery, useReadAdminNotificationMutation, useReadAllAdminNotificationsMutation, type AdminNotification } from '../features/api/notificationApi';

export function AdminNotificationInbox({ onClose }: { onClose: () => void }) {
  const { data, isLoading, error, refetch, isFetching } = useListAdminNotificationsQuery(undefined, { refetchOnMountOrArgChange: true });
  const [read] = useReadAdminNotificationMutation();
  const { refetch: refetchCount } = useAdminUnreadCountQuery();
  const [readAll, { isLoading: isMarking }] = useReadAllAdminNotificationsMutation();
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const open = async (item: AdminNotification) => {
    setMessage('');
    try { if (!item.isRead) await read(item._id).unwrap(); }
    catch { setMessage('Could not update the read status. You can still open the related page.'); }
    const destination = item.type === 'ComplaintUpdate' ? '/complaints' : item.type === 'BookingUpdate' ? '/rooms' : item.type === 'RentDue' ? '/payments' : item.type === 'TaskAssigned' ? '/cleaning' : null;
    if (destination) { onClose(); navigate(destination); }
  };
  return <div className="space-y-3">
    <div className="flex flex-wrap justify-between gap-2"><button className="auth-secondary-button" type="button" disabled={isFetching} onClick={() => { void refetch(); void refetchCount(); }}>Refresh</button><button className="auth-secondary-button" type="button" disabled={isMarking || !data?.some((item) => !item.isRead)} onClick={async () => { try { await readAll().unwrap(); } catch { setMessage('Unable to mark all notifications as read.'); } }}>{isMarking ? 'Marking...' : 'Mark all read'}</button></div>
    {data && data.length >= 50 && <p className="text-xs text-slate-500">Showing the latest 50 notifications.</p>}
    {message && <p role="alert">{message}</p>}
    {isLoading ? <p role="status">Loading notifications...</p> : error ? <p role="alert">Unable to load notifications. Use Refresh to try again.</p> : !data?.length ? <p>No notifications yet.</p> : data.map((item) => <button key={item._id} type="button" className={`w-full rounded-xl border p-4 text-left ${item.isRead ? 'border-slate-200 bg-white' : 'border-blue-200 bg-blue-50'}`} onClick={() => { void open(item); }}>
      <span className="block text-sm font-semibold">{item.title}{!item.isRead ? ' · Unread' : ''}</span><span className="mt-1 block text-sm text-slate-600">{item.body}</span><time className="mt-2 block text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</time>
    </button>)}
  </div>;
}
