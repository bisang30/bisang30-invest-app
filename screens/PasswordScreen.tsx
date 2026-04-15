
import React, { useState } from 'react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

interface PasswordScreenProps {
  onLogin: (password: string) => void;
}

const PasswordScreen: React.FC<PasswordScreenProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-light-bg dark:bg-dark-bg p-4">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">비밀번호 입력</h1>
          <p className="text-light-secondary dark:text-dark-secondary">앱에 접근하려면 비밀번호를 입력하세요.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="비밀번호"
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <Button type="submit" className="w-full">
            잠금 해제
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default PasswordScreen;
