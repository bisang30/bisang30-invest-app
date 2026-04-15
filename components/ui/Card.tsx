

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = '', title }) => {
  return (
    <div className={`bg-light-card dark:bg-dark-card rounded-lg shadow-md p-4 sm:p-6 border border-gray-200/80 dark:border-slate-700 ${className}`}>
      {title && <h2 className="text-xl font-semibold mb-4 text-light-text dark:text-dark-text">{title}</h2>}
      {children}
    </div>
  );
};

export default Card;