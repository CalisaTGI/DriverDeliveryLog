export async function deleteLocation(db, name) {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    throw new Error('Location name is required');
  }

  const result = await db.run('DELETE FROM locations WHERE name = ?', [trimmedName]);
  return result.changes > 0;
}
