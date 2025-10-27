import React from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import colors from '../constants/colors';

interface InputFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  touched?: boolean;
  containerStyle?: ViewStyle;
}

const InputField: React.FC<InputFieldProps> = ({
  label,
  error,
  touched,
  containerStyle,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          error && touched && styles.inputError,
        ]}
        placeholderTextColor={colors.GRAY.DEFAULT}
        autoCapitalize="none"
        {...props}
      />
      {error && touched && (
        <Text style={styles.errorText}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  label: {
    color: colors.BLACK,
    fontSize: 16,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.GRAY.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: colors.BLACK,
    backgroundColor: colors.WHITE,
  },
  inputError: {
    borderColor: colors.DANGER.DEFAULT,
  },
  errorText: {
    color: colors.DANGER.DEFAULT,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default InputField; 