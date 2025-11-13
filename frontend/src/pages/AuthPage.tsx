import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import axios from "axios";
import useStore from "@/store";

const AuthPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const setAuth = useStore((state) => state.setAuth);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // OAuth2 password flow - send as form-urlencoded
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username", username);
      params.append("password", password);
      params.append("scope", "");

      const response = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL}/auth/token`,
        params,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const accessToken = response.data.access_token;

      // Fetch user profile after getting token
      const userResponse = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/auth/users/me`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Store token and user in Zustand store (persisted to localStorage automatically)
      setAuth({ token: accessToken, user: userResponse.data });

      toast({
        title: "Login Successful",
        description: `Welcome back, ${userResponse.data.username}!`,
      });

      navigate("/home");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.response?.data?.detail || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate random stars for background
  const stars = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    size: Math.random() * 40 + 20,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 3,
  }));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted relative overflow-hidden">
      {/* Animated Star Background */}
      <div className="fixed inset-0 pointer-events-none">
        {stars.map((star) => (
          <Star
            key={star.id}
            className="absolute text-primary star-animate"
            style={{
              width: `${star.size}px`,
              height: `${star.size}px`,
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Login Form */}
      <div className="w-full max-w-[450px] px-6 z-10">
        <div className="bg-card rounded-2xl shadow-2xl p-8 border border-border">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              STARAI
            </h1>
            <p className="text-lg text-muted-foreground">
              An Anomaly Detection Platform
            </p>
            <p className="text-lg text-muted-foreground">
              By the Mak's Men
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="username" className="text-base font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="h-[50px] text-lg mt-2"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-base font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-[50px] text-lg mt-2"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          </form>
        </div>
      </div>

      {/* Bottom Carousel */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-primary/20 to-accent/20 py-4 overflow-hidden">
        <div className="flex carousel-scroll">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="flex whitespace-nowrap min-w-full justify-around px-8">
              <span className="text-xl font-semibold text-primary mx-8">
                🔍 Triage
              </span>
              <span className="text-xl font-semibold text-primary mx-8">
                🎯 Predictive Anomaly Detection
              </span>
              <span className="text-xl font-semibold text-primary mx-8">
                ✓ High Accuracy Anomaly Detection
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
