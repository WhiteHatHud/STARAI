import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center">
        <h1 className="text-9xl font-bold text-primary mb-4">404</h1>
        <h2 className="text-3xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-xl text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft size={20} />
            Go Back
          </Button>
          <Button size="lg" onClick={() => navigate("/home")}>
            <Home size={20} />
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
