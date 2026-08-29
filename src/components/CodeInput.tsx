import React, { useState } from 'react';
import { Input, message } from 'antd';
import type { InputProps } from 'antd';
import api from '../api/axiosClient';

interface CodeInputProps extends Omit<InputProps, 'suffix'> {
  /** prefix gợi ý để generate (VD: "NCC", "SP"). Nếu không truyền, dùng value hiện tại */
  prefix?: string;
  /** Entity name mapping với BE: item | supplier | itemGroup | prodGroup | unit */
  entity: 'item' | 'supplier' | 'itemGroup' | 'prodGroup' | 'unit';
  /** Callback khi code được generate thành công */
  onGenerate?: (code: string) => void;
}

/**
 * Input mã code với nút "Tạo mã" suffix — gọi BE generate + check trùng.
 *
 * Dùng trong Form.Item: onChange/value được truyền tự động bởi Ant Design Form.
 */
const CodeInput: React.FC<CodeInputProps> = ({
  prefix,
  entity,
  onGenerate,
  value,
  onChange,
  disabled,
  ...rest
}) => {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    const p = (prefix ?? (typeof value === 'string' ? value.replace(/\d+$/, '') : '')) || '';
    if (!p) {
      message.warning('Nhập prefix trước (VD: SP, NCC...)');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<{ code: string }>('/api/v1/codes/generate', {
        prefix: p.toUpperCase(),
        entity,
      } as any);
      const code = (res as any)?.code ?? res;
      if (onGenerate) onGenerate(code);
      // Trigger Ant Design Form onChange
      if (onChange) {
        onChange({ target: { value: code } } as React.ChangeEvent<HTMLInputElement>);
      }
    } catch {
      // handled by axiosClient
    } finally {
      setLoading(false);
    }
  };

  return (
    <Input
      {...rest}
      value={value}
      onChange={onChange}
      disabled={disabled}
      suffix={
        !disabled ? (
          <a
            onClick={loading ? undefined : handleGenerate}
            style={{
              fontSize: 12,
              color: loading ? '#94a3b8' : '#2563eb',
              cursor: loading ? 'not-allowed' : 'pointer',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Đang tạo...' : 'Tạo mã'}
          </a>
        ) : undefined
      }
    />
  );
};

export default CodeInput;
