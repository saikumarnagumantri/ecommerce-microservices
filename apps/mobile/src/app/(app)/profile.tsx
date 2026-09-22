import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../api/auth';
import { extractErrorMessage } from '../../api/client';
import { colors, radius, spacing } from '../../theme';

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      await updateProfile({ name, phone: phone || undefined });
      await refreshProfile();
      setSavedMessage('Profile updated.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not save your profile'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.email}>{user.email}</Text>

      <Text style={styles.label}>Name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Phone</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Not set" />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {savedMessage ? <Text style={styles.saved}>{savedMessage}</Text> : null}

      <TouchableOpacity style={styles.saveButton} onPress={onSave} disabled={saving}>
        {saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.saveButtonText}>Save changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={() => Alert.alert('Log out?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Log out', style: 'destructive', onPress: () => void logout() },
        ])}
      >
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.xl },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: spacing.lg },
  avatarInitial: { color: colors.primaryText, fontSize: 24, fontWeight: '800' },
  email: { textAlign: 'center', color: colors.muted, marginTop: spacing.sm, marginBottom: spacing.xl, fontSize: 13 },
  label: { fontSize: 12, color: colors.muted, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
  saved: { color: colors.success, marginTop: spacing.md, fontSize: 13 },
  saveButton: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xl },
  saveButtonText: { color: colors.primaryText, fontWeight: '700', fontSize: 15 },
  logoutButton: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  logoutButtonText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
});
